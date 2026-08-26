# One command sets up the whole system on the real machines:
#
#   make deploy
#
# Everything else here is a convenience. `make check` runs on this laptop and
# touches no machine.

ANSIBLE_DIR := infra/ansible
export ANSIBLE_CONFIG := $(ANSIBLE_DIR)/ansible.cfg

PLAYBOOKS := $(ANSIBLE_DIR)/scenarios/setup-fleet.yml $(ANSIBLE_DIR)/scenarios/check-rendering.yml
GALAXY_STAMP := $(ANSIBLE_DIR)/.galaxy-installed

.PHONY: help deploy deploy-app deploy-checkers check lint

help: ## Show these targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

deploy: $(GALAXY_STAMP) ## Set up the application machine and every checker
	ansible-playbook $(ANSIBLE_DIR)/scenarios/setup-fleet.yml $(ARGS)

deploy-app: $(GALAXY_STAMP) ## Only the application machine
	ansible-playbook $(ANSIBLE_DIR)/scenarios/setup-fleet.yml --limit 'control:application' $(ARGS)

deploy-checkers: $(GALAXY_STAMP) ## Only the checker machines
	ansible-playbook $(ANSIBLE_DIR)/scenarios/setup-fleet.yml --limit 'control:application:checkers' \
		--skip-tags postgres,web,proxy $(ARGS)

check: $(GALAXY_STAMP) ## Check the playbooks and what they would write, without touching a machine
	ansible-playbook --syntax-check $(PLAYBOOKS)
	ansible-playbook $(ANSIBLE_DIR)/scenarios/check-rendering.yml
	@if command -v ansible-lint > /dev/null; then ansible-lint $(PLAYBOOKS); \
	else echo "ansible-lint is not installed; skipped. uv tool install ansible-lint"; fi

lint: ## Run ansible-lint alone
	ansible-lint $(PLAYBOOKS)

# The one collection the playbook needs, pinned in requirements.yml. The marker
# keeps a re-run from asking the galaxy again.
$(GALAXY_STAMP): $(ANSIBLE_DIR)/requirements.yml
	@command -v ansible-playbook > /dev/null || { \
		echo "Ansible is not installed. uv tool install ansible, or pipx install ansible."; exit 1; }
	# --force, so the pinned version lands in the collections path whatever a
	# distribution happens to bundle. ansible-lint reads that path too.
	ansible-galaxy collection install --force -r $(ANSIBLE_DIR)/requirements.yml
	@touch $@
