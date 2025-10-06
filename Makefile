ifeq ($(shell uname), Linux)
	SED_ARGS = -i
else # macOS, BSD, etc.
	SED_ARGS = -i ''
endif


setup:
	# https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#build-environment
	if ! command -v pandoc >/dev/null 2>&1; then \
        echo "Installing pandoc..."; \
        apt install -y pandoc; \
    else \
        echo "pandoc is already installed."; \
    fi


docs:
	pandoc README.md -o docs/index.html --template=docs/templ.html
	sed $(SED_ARGS) 's|src="docs/logo.svg"|src="logo.svg"|' docs/index.html

.PHONY: docs setup
