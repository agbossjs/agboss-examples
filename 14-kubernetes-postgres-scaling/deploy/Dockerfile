# The image of every pod of the blueprint (agbossjs/agboss#487), built by
# scripts/cluster/build-image.mjs from a staged context: the compiled `dist/`, a package.json whose
# @agboss/core and @agboss/postgres are the tarballs packed from the project's installed packages
# (the release candidate today, the registry versions after 0.1.1), and nothing else.
# tini is PID 1: it forwards SIGTERM to node, and a signal sent to node from `kubectl exec` (the
# scenario's SIGSTOP / SIGCONT / kill -9) reaches it — PID 1 of a namespace ignores those.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
RUN apk add --no-cache tini
WORKDIR /app
ARG NPM_BEFORE
COPY package.json ./
COPY vendor ./vendor
RUN npm install --omit=dev --no-audit --no-fund --ignore-scripts --before="${NPM_BEFORE}" && npm cache clean --force
COPY dist ./dist
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
