NAME := $(shell node -p "require('./package.json').name")
VERSION := $(shell node -p "require('./package.json').version")
TARBALL := $(NAME)-$(VERSION).tgz

.PHONY: build install test clean tar

build:
	npm run build

install:
	npm install

test:
	npm test

clean:
	npm run clean

tar:
	$(MAKE) clean
	$(MAKE) build
	mkdir -p publish
	npm pack --pack-destination publish
	@echo "wrote publish/$(TARBALL)"
