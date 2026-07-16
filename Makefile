.PHONY: help lint typecheck test coverage build quality security-scan clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: ## Run linter (ESLint)
	@echo "Running linter..."
	npm run lint

typecheck: ## Type checking (TypeScript)
	@echo "Running type check..."
	npm run check

test: ## Run tests with coverage
	@echo "Running tests with coverage..."
	npm test -- --coverage

coverage: test ## Show coverage report (alias for test)
	@echo "Coverage report generated in coverage/"

security-scan: ## Security vulnerability scan (npm audit)
	@echo "Running security scan..."
	npm audit --audit-level=moderate
	@echo "Security scan complete. Fix any high/critical vulnerabilities."

build: ## Production build
	@echo "Building project..."
	npm run build

quality: lint typecheck test security-scan ## Run all quality checks (pre-commit standard)
	@echo "All quality checks passed ✅"

clean: ## Clean build artifacts and coverage
	@echo "Cleaning..."
	rm -rf dist/ coverage/ .tsbuildinfo
	@echo "Clean complete"

# Verification steps for manual testing before commit
verify: quality ## Alias for quality checks

# Development shortcuts
dev: ## Start development mode
	npm run dev

install: ## Install dependencies
	npm ci

# CI helper (used in GitHub Actions)
ci: quality build ## Run full CI pipeline
