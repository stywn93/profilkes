# Profil Kesehatan - AKI/AKB pilot
#
#   make up        start the whole stack in Docker (db, loader, api, web)
#   make dev       run the api + web dev servers locally against the container db
#   make verify    run the 12 invariant checks
#
# Everything is safe to re-run: the schema is additive and the loader upserts.

SHELL := /bin/bash
COMPOSE := docker compose
PYTHON := .venv/bin/python
DB_SERVICE := db
DB_URL := postgresql://postgres:postgres@localhost:55432/profilkes

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- docker stack
.PHONY: up
up: ## Build and start db + loader + api + web in Docker
	$(COMPOSE) up --build -d
	@echo
	@echo "Dashboard : http://127.0.0.1:5173"
	@echo "API       : http://127.0.0.1:8787/api/health"
	@$(MAKE) --no-print-directory ps

.PHONY: down
down: ## Stop the stack and remove the containers
	$(COMPOSE) down

.PHONY: ps
ps: ## Show the status of the stack
	$(COMPOSE) ps -a

.PHONY: logs
logs: ## Follow the logs of the stack
	$(COMPOSE) logs -f

.PHONY: rebuild
rebuild: ## Rebuild the images from scratch (use after changing a package.json)
	$(COMPOSE) build --no-cache

.PHONY: reload
reload: ## Re-apply the schema and re-load the workbook
	$(COMPOSE) run --rm loader

.PHONY: reset
reset: ## Drop every object and rebuild the database from the workbook
	$(COMPOSE) exec -T db psql -U postgres -d profilkes -f - < db/00_reset.sql
	$(MAKE) --no-print-directory reload

.PHONY: verify
verify: ## Run the 12 invariant checks
	$(COMPOSE) run --rm verify

# ---------------------------------------------------------------- inspecting
.PHONY: psql
psql: ## Open a psql shell on the database (no local psql needed)
	@echo "DSN for a GUI client: postgresql://postgres:postgres@127.0.0.1:55432/profilkes (SSL off)"
	$(COMPOSE) exec db psql -U postgres -d profilkes

.PHONY: tables
tables: ## List every table and view with its row count
	@$(COMPOSE) exec -T db psql -U postgres -d profilkes -f /scripts/tables.sql

.PHONY: dump
dump: ## Write the whole database to export/profilkes.sql
	@mkdir -p export
	$(COMPOSE) exec -T db pg_dump -U postgres -d profilkes --clean --if-exists > export/profilkes.sql
	@echo "export/profilkes.sql"

.PHONY: export
export: ## Write every mart and fact table to export/*.csv (opens in Excel)
	@mkdir -p export
	@for t in $$(docker compose exec -T db psql -U postgres -d profilkes -Atc \
		"SELECT format('%I.%I', table_schema, table_name) FROM information_schema.tables \
		  WHERE table_schema IN ('dim','etl','fact','mart','public') ORDER BY 1"); do \
		name=$$(echo $$t | tr '.' '_'); \
		$(COMPOSE) exec -T db psql -U postgres -d profilkes -c \
			"COPY (SELECT * FROM $$t) TO STDOUT WITH CSV HEADER" > export/$$name.csv; \
		echo "export/$$name.csv"; \
	done

# ---------------------------------------------------------------- local dev
.PHONY: db
db: ## Start only the Postgres container
	$(COMPOSE) up -d $(DB_SERVICE)

.PHONY: venv
venv: ## Create the virtualenv and install the Python dependencies
	python3 -m venv .venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -r scripts/requirements.txt

.PHONY: init
init: ## Apply the schema, build the marts and load the workbook
	$(PYTHON) scripts/init_db.py

.PHONY: dev
dev: ## Run the api and the web dev server locally (Ctrl-C stops both)
	@echo "api  : http://127.0.0.1:8787"
	@echo "web  : http://127.0.0.1:5173"
	@scripts/dev.sh

# ---------------------------------------------------------------- checks
.PHONY: check
check: lint typecheck build ## Lint, type-check and build the dashboard

.PHONY: lint
lint: ## Lint the dashboard
	cd web && npm run lint

.PHONY: typecheck
typecheck: ## Type-check the API
	cd server && npm run typecheck

.PHONY: build
build: ## Type-check and build the dashboard for production
	cd web && npm run build
