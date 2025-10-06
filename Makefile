ifeq ($(shell uname), Linux)
	SED_ARGS = -i
else # macOS, BSD, etc.
	SED_ARGS = -i ''
endif

docs:
	pandoc README.md -o docs/index.html --template=docs/templ.html
	sed $(SED_ARGS) 's|src="docs/logo.svg"|src="logo.svg"|' docs/index.html

.PHONY: docs setup
