# One-command deployment

The production deployment uses one root `.env` file and exposes only one host port. MariaDB, Redis, and the API communicate on the private Docker network and do not require host ports or connection settings.

## First deployment

On the server, clone the repository and enter it:

```bash
git clone <repository-url> ti
cd ti
cp .env.example .env
```

Edit the host port and database connection settings in `.env`:

```env
APP_PORT=8080
DATABASE_HOST=mariadb
DATABASE_PORT=3306
DATABASE_NAME=luogu_ti
DATABASE_USER=app
DATABASE_PASSWORD=replace-with-a-long-random-password
```

Start the whole stack with one command:

```bash
bash scripts/deploy.sh
```

It fast-forwards the current branch, builds the API and web images once, runs database initialization automatically, and starts all services. The public site is available on `http://<server-ip>:APP_PORT`; `/api` is routed internally to the API service. To use an external database, set `DATABASE_HOST` to its IP or hostname and provide its port, database name, username, and password.

## Subsequent releases

After pushing code to the configured remote, run the same command on the server:

```bash
bash scripts/deploy.sh
```

The script refuses non-fast-forward pulls, preserving local changes instead of overwriting them. It also recognizes the previous `MARIADB_PASSWORD` setting and adds `DATABASE_PASSWORD` on the first migration run.

## Optional settings

`TZ`, `NPM_REGISTRY`, `CPOAUTH_BASE_URL`, and the `S3_*` variables in `.env.example` are optional. They are not needed to start the core application.
