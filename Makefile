PYTHON ?= python3
BACKEND_VENV ?= backend/.venv
BACKEND_PIP := $(BACKEND_VENV)/bin/pip

.PHONY: setup test lint typecheck check build-web run-backend run-mobile run-web

setup:
	$(PYTHON) -m venv $(BACKEND_VENV)
	$(BACKEND_PIP) install --upgrade pip
	$(BACKEND_PIP) install -r backend/requirements-dev.txt
	npm --prefix apps/mobile ci
	npm --prefix apps/web ci

test:
	cd backend && APP_ENV=test .venv/bin/pytest -q
	npm --prefix apps/mobile test
	npm --prefix apps/web test

lint:
	cd backend && .venv/bin/ruff check app tests migrations
	cd backend && .venv/bin/ruff format --check app tests migrations
	npm --prefix apps/mobile run lint
	npm --prefix apps/web run lint

typecheck:
	npm --prefix apps/mobile run typecheck
	npm --prefix apps/web run typecheck

build-web:
	npm --prefix apps/web run build

check: lint typecheck test build-web

run-backend:
	cd backend && .venv/bin/fastapi dev app/main.py

run-mobile:
	npm --prefix apps/mobile start

run-web:
	npm --prefix apps/web run dev
