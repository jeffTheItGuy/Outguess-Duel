# Outguess Duel Makefile
# Docker Compose only — no local npm/Hardhat/Vite commands.

.DEFAULT_GOAL := help
SHELL := /bin/bash

COMPOSE_FILE ?= docker-compose.dev.yml

# Supports both modern "docker compose" and older "docker-compose".
DOCKER_COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
COMPOSE := $(DOCKER_COMPOSE) -f $(COMPOSE_FILE)
RUN := $(COMPOSE) run --rm

# Avoids copy/paste tab issues.
# If your Make version does not support .RECIPEPREFIX, ask for a tabbed version.
.RECIPEPREFIX := >

.PHONY: \
	help \
	install \
	compile \
	test \
	check \
	build \
	deploy \
	watch \
	dev \
	up \
	down \
	logs \
	ps \
	restart \
	fresh \
	reset-chain \
	clean \
	distclean \
	shell


install: ## Install root and frontend dependencies using the Docker setup service
> $(COMPOSE) run --rm --no-deps setup

compile: install ## Compile contracts inside Docker
> $(RUN) --no-deps contracts sh -c "npm run compile"

test: install ## Run Hardhat tests inside Docker
> $(RUN) -e HARDHAT_NETWORK=hardhat --no-deps contracts sh -c "npm run test"

check: install compile test ## Install, compile contracts, and run tests

build: install compile ## Install, compile contracts, and build the frontend inside Docker
> $(RUN) --no-deps frontend sh -c "npm run build"

deploy: ## Start chain if needed, wait for RPC, then deploy contracts
> $(COMPOSE) up -d chain
> $(RUN) --no-deps contracts sh -c "until node scripts/rpc-healthcheck.mjs; do echo 'Waiting for RPC...'; sleep 2; done; npx hardhat run scripts/deploy-local.ts --network localhost"

watch: ## Start chain if needed, then run contract watcher in foreground
> $(COMPOSE) up -d chain
> $(RUN) --no-deps contracts node scripts/watch-deploy.mjs

dev: ## Start full Docker dev stack in the foreground
> $(COMPOSE) up

up: ## Start full Docker dev stack detached
> $(COMPOSE) up -d

down: ## Stop and remove Docker containers
> $(COMPOSE) down

logs: ## Tail all Docker Compose logs
> $(COMPOSE) logs -f

ps: ## Show Docker Compose service status
> $(COMPOSE) ps

restart: ## Restart all Docker services
> $(COMPOSE) restart

fresh: ## Recreate containers without removing named volumes
> $(COMPOSE) down --remove-orphans || true
> $(COMPOSE) up -d

reset-chain: ## Recreate chain and contracts services for a fresh deploy
> $(COMPOSE) up -d --force-recreate chain contracts

clean: ## Remove generated caches/artifacts using a Docker container
> $(RUN) --no-deps setup sh -c "rm -rf cache artifacts frontend/dist frontend/node_modules/.vite typechain-types coverage coverage.json" || true

distclean: clean ## Remove containers, networks, and named volumes
> $(COMPOSE) down -v --remove-orphans || true

shell: ## Open a shell inside a one-off contracts container
> $(RUN) --no-deps contracts sh