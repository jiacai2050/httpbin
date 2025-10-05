
docs:
	pandoc README.md -o docs/index.html --template=docs/templ.html

.PHONY: docs
