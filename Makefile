.PHONY: run build release

ifeq (run,$(firstword $(MAKECMDGOALS)))
RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
ifneq ($(RUN_ARGS),)
$(eval $(RUN_ARGS):;@:)
endif
endif

run:
	cargo run -- $(RUN_ARGS) $(ARGS)

build:
	cargo build

release:
	cargo build --release
