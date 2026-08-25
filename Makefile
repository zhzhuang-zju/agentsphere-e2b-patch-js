NAME := $(shell node -p "require('./package.json').name")
VERSION := $(shell node -p "require('./package.json').version")
TARBALL := $(NAME)-$(VERSION).tgz
PKGDIR := $(notdir $(CURDIR))

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
	tar --exclude=$(PKGDIR)/node_modules \
		--exclude=$(PKGDIR)/publish \
		--exclude=$(PKGDIR)/.git \
		-czf publish/$(TARBALL) \
		-C .. $(PKGDIR)
	@echo "wrote publish/$(TARBALL)"
