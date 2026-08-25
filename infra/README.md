# Setting up the real machines

One command sets up the whole system - the application machine and every checker:

```bash
make deploy
```

Run it from a fresh checkout, run it again after any change; it changes only what differs.
It needs Ansible on your own machine (`uv tool install ansible`, or `pipx install ansible`) and SSH access to the machines, which you already have.

```bash
make check            # everything below except touching a machine
make deploy-app       # only the application machine
make deploy-checkers  # only the checkers, and the tunnels that reach them
```

## Before the first run

Copy the example and fill it in:

```bash
cp infra/ansible/deploy.env.example infra/ansible/deploy.env
```

That file is gitignored and is the only place a real secret lives.
Nothing in it reaches an image; it is rendered into env files on the machines, readable by root alone.

| Key | What it is |
| --- | --- |
| `OJ_SERVICE_KEY` | The shared key every call to a checker carries. The same string reaches the app and all thirteen machines. |
| `OJ_POSTGRES_PASSWORD` | The password of the application machine's Postgres. |
| `OJ_SESSION_SECRET` | Signs the login cookie. Change it and everyone is signed out. |
| `OJ_DOMAIN` | The domain the site answers on. Leave empty and it answers over plain HTTP on the machine's address. |
| `OJ_ACME_EMAIL` | Where Let's Encrypt writes about an expiring certificate. Required once a domain is set. |

`openssl rand -hex 32` makes a good value for the first three.
The playbook refuses to start until they are set.

## What ends up where

The application machine, all in Docker, nothing but the proxy publishing a port:

- **Postgres 17**, on an internal network, no published port at all.
- **The app**, which applies migrations and seeds the four problems before it serves.
- **The proxy**, which obtains and renews a certificate for `OJ_DOMAIN` by itself. With no domain it serves the site over plain HTTP on port 80; adding the domain later is that line in `deploy.env` and `make deploy` again.
- **The tunnels**, one container holding a permanent SSH connection to every checker.

Every checker machine: the checker service from `deploy/checker/Dockerfile.bwrap`, its port published on `127.0.0.1` and nowhere else, with the three sandbox grants that image needs and not one more, and its own copy of `problems/` mounted read only.
No test data is baked into any image.

## The tunnels

Nothing is exposed on a checker machine and no firewall rule is added anywhere.
The only inbound port used is SSH, which already works.

The application machine holds one SSH connection to each checker, forwarding a port of its own to that checker's service.
Those forwards live in one small container called `tunnels`, on the app's own Docker network, so the app asks `tunnels:9001` and reaches `checker-01`'s own `127.0.0.1:8080`.
The app therefore needs no host networking and never learns a checker's address.

Each forward has a supervisor that dials again five seconds after a drop, and the container restarts with the machine, so a checker that reboots is back on its own.
The container is healthy while its supervisors are alive - whether a particular checker is answering is the app's own question, asked on `/admin`.

The application machine gets a keypair of its own, generated there on the first run.
The private half never leaves that machine; your personal key is never copied to a server.
The public half is installed on each checker with the narrowest options SSH has: it may open one forward, to that machine's checker port, and nothing else - no shell, no command, no agent, no tty.

## Adding or removing a machine

One line in `infra/ansible/hosts.yml`, then `make deploy` again:

```yaml
checker-14: {ansible_host: 203.0.113.7, ansible_user: ubuntu, checker_local_port: 9014}
```

`checker_local_port` must differ from every other one.
That inventory is the single source: the app's `CHECKER_MACHINES` and the tunnel list are both rendered from it, so they cannot disagree.
Delete the line instead and the machine is retired: the app stops giving it work and its tunnel goes.

`make check` reads both files back and says so if they ever stop matching.

## Running it again

Safe at any time.
The machines are given the committed tree at `HEAD` as one archive, and every image is tagged with that commit, so the same commit builds nothing and recreates no container - a machine that is judging submissions is left judging them.
Uncommitted work is not deployed, and the run says so when the checkout has any.

Every image tag is pinned. Nothing is `latest`.

## Layout

| Path | What it is |
| --- | --- |
| `infra/ansible/hosts.yml` | Every machine, and the port each checker's tunnel ends on |
| `infra/ansible/deploy.env` | The secrets. Gitignored; `deploy.env.example` documents it |
| `infra/ansible/group_vars/` | Everything else that is configurable |
| `infra/ansible/scenarios/` | `setup-fleet.yml` is what `make deploy` runs |
| `infra/ansible/capabilities/` | One role per effect, named for what it does |

On a machine, everything this deployment owns lives under `/opt/online-judge`: the compose files and rendered env files in `compose/`, the source it builds from in `src/`, the database and the certificates in `data/`, a checker's problem packages in `problems/`.

## Two things worth knowing

The panel at `/admin` is reachable by anyone who knows the address.
That is deliberate for this deployment.

The sandbox needs `SYS_ADMIN`, `NET_ADMIN` and the default seccomp profile out of the way; `deploy/README.md` works out why each is needed and what fails without it.
That is the reason a checker deserves a machine of its own, which is exactly what it gets here.
