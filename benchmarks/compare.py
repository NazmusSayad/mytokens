import argparse
import json
import os
import re
import shlex
import shutil
import statistics
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HOME = Path.home()
SCREEN = "models-by-tokens"
PARSE_CACHES = {
    "rust": ["source-message-cache-v2"],
    "ts": ["parse-cache-v2.json", "parse-cache-v1.json"],
    "tokenstat": ["parse-cache.db", "parse-cache.db-wal", "parse-cache.db-shm"],
}
SCENARIOS = [
    ("startup", ["--help"], False),
    ("warm, last 30 days", [SCREEN], False),
    ("warm, --all", ["--all", SCREEN], False),
    ("--fresh --all", ["--fresh", "--all", SCREEN], False),
    ("cold --all", ["--all", SCREEN], True),
]
ANSI = re.compile(r"\x1b\[[0-9;]*m")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare speed, memory, disk use and totals of the Rust, TS and tokenstat CLIs on your local history."
    )
    parser.add_argument("--rust", default=str(REPO / "target/release/mytokens"), help="Rust binary")
    parser.add_argument("--ts", help='TS command, for example "node ../mytokens-main/dist/index.js"')
    parser.add_argument("--tokenstat", help='tokenstat command, for example "node node_modules/tokenstat/dist/index.js"')
    parser.add_argument("--runs", type=int, default=10, help="measured runs per scenario")
    parser.add_argument(
        "--work-dir",
        default=str(HOME / ".cache/mytokens-bench"),
        help="sandbox homes; keep it on a real disk so cold runs include disk syncs",
    )
    parser.add_argument("--out", default=str(REPO / "benchmarks/results"), help="report directory")
    return parser.parse_args()


def sandbox_home(work_dir, name):
    home = work_dir / f"home-{name}"
    if home.exists():
        shutil.rmtree(home)
    home.mkdir(parents=True)
    for entry in HOME.iterdir():
        if entry.name == ".mytokens" or entry.resolve() == work_dir.resolve():
            continue
        (home / entry.name).symlink_to(entry)
    config = home / ".mytokens"
    config.mkdir()
    real_config = HOME / ".mytokens"
    if (real_config / "groups.json").exists():
        (config / "groups.json").symlink_to(real_config / "groups.json")
    cache = config / "cache"
    shutil.copytree(real_config / "cache", cache, symlinks=True, ignore=shutil.ignore_patterns(*sum(PARSE_CACHES.values(), [])))
    return home


def read_io():
    with open("/proc/self/io") as f:
        return {key: int(value) for key, value in (line.split(": ") for line in f)}


def poll_threads(pid, stop, out):
    peak = 0
    while not stop.is_set():
        try:
            with open(f"/proc/{pid}/status") as f:
                for line in f:
                    if line.startswith("Threads:"):
                        peak = max(peak, int(line.split()[1]))
        except (FileNotFoundError, ProcessLookupError):
            break
        time.sleep(0.005)
    out["threads"] = peak


def run(command, home, args, capture=False):
    env = dict(os.environ, HOME=str(home), COLUMNS="200")
    env.pop("CLAUDE_CONFIG_DIR", None)
    env.pop("TOKSCALE_CONFIG_DIR", None)
    before = read_io()
    started = time.perf_counter()
    process = subprocess.Popen(
        command + args,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=str(home),
        env=env,
    )
    stop, extra = threading.Event(), {}
    poller = threading.Thread(target=poll_threads, args=(process.pid, stop, extra))
    poller.start()
    output = process.stdout.read().decode() if capture else None
    _, status, usage = os.wait4(process.pid, 0)
    wall = time.perf_counter() - started
    stop.set()
    poller.join()
    after = read_io()
    if os.waitstatus_to_exitcode(status) != 0:
        raise RuntimeError(f"{shlex.join(command + args)} exited with status {status}")
    if capture:
        return ANSI.sub("", output)
    return {
        "wall_ms": wall * 1000,
        "cpu_s": usage.ru_utime + usage.ru_stime,
        "rss_mb": usage.ru_maxrss / 1024,
        "read_mb": (after["rchar"] - before["rchar"]) / 1e6,
        "disk_write_mb": (after["write_bytes"] - before["write_bytes"]) / 1e6,
        "threads": extra.get("threads", 0),
    }


def clear_parse_cache(home, name):
    for entry in PARSE_CACHES[name]:
        path = home / ".mytokens/cache" / entry
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()


def totals(command, home):
    result = {}
    for screen in ["sources-by-tokens", "sources-by-requests", "sources-by-costs"]:
        output = run(command, home, ["--all", screen], capture=True)
        match = re.search(r"Total \(([^)]+)\)", output)
        if match is None:
            raise RuntimeError(f"no total found in {screen} output")
        result[screen.removeprefix("sources-by-")] = match.group(1)
    return result


def main():
    args = parse_args()
    commands = {"rust": [args.rust]}
    if args.ts:
        commands["ts"] = shlex.split(args.ts)
    if args.tokenstat:
        commands["tokenstat"] = shlex.split(args.tokenstat)
    work_dir = Path(args.work_dir).expanduser()
    work_dir.mkdir(parents=True, exist_ok=True)
    homes = {name: sandbox_home(work_dir, name) for name in commands}

    for name, command in commands.items():
        run(command, homes[name], ["--all", SCREEN])

    results = {}
    for scenario, scenario_args, cold in SCENARIOS:
        for name, command in commands.items():
            run(command, homes[name], scenario_args)
            runs = []
            for _ in range(args.runs):
                if cold:
                    clear_parse_cache(homes[name], name)
                runs.append(run(command, homes[name], scenario_args))
            medians = {key: statistics.median(r[key] for r in runs) for key in runs[0]}
            results.setdefault(scenario, {})[name] = medians
            print(f"{scenario:20s} {name:10s} {medians['wall_ms']:8.0f} ms", file=sys.stderr, flush=True)

    accuracy = {name: totals(command, homes[name]) for name, command in commands.items()}

    names = list(commands)
    lines = [f"# mytokens comparison ({time.strftime('%Y-%m-%d %H:%M')}, {args.runs} runs, medians)", ""]
    for label, key, unit, digits in [
        ("Wall time", "wall_ms", "ms", 0),
        ("CPU time", "cpu_s", "s", 2),
        ("Peak memory", "rss_mb", "MB", 0),
        ("Data read", "read_mb", "MB", 1),
        ("Written to disk", "disk_write_mb", "MB", 1),
        ("Threads", "threads", "", 0),
    ]:
        lines += [f"## {label}", "", "| Scenario | " + " | ".join(names) + " |", "|---" * (len(names) + 1) + "|"]
        for scenario in results:
            cells = [f"{results[scenario][name][key]:.{digits}f} {unit}".strip() for name in names]
            lines.append(f"| {scenario} | " + " | ".join(cells) + " |")
        lines.append("")
    lines += ["## Totals (`--all`)", "", "| | " + " | ".join(names) + " |", "|---" * (len(names) + 1) + "|"]
    for metric in ["tokens", "requests", "costs"]:
        lines.append(f"| {metric} | " + " | ".join(accuracy[name][metric] for name in names) + " |")
    report = "\n".join(lines) + "\n"

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    (out / f"{stamp}.md").write_text(report)
    (out / f"{stamp}.json").write_text(json.dumps({"results": results, "totals": accuracy}, indent=2))
    print(report)


main()
