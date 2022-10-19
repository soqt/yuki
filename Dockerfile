FROM node:16-alpine3.15 AS base

## set our node environment, either development or production
## defaults to production, compose overrides this to development on build and run
#ARG NODE_ENV=production
#ENV NODE_ENV $NODE_ENV

# default to port 3000 for node, and 9229 and 9230 (tests) for debug
ARG PORT=3000
ENV PORT $PORT
EXPOSE $PORT 9229 9230

# 安装Alphine必要apk包和NPM
RUN apk add --no-cache python3 make g++ && rm -rf /var/cache/apk/*
RUN apk add --no-cache git openssh
RUN npm i npm@latest pnpm -g && npm install typescript -g


FROM base AS builder

RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/
WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install
COPY . .

RUN chown -R node /usr/src
USER node

RUN pnpm run build


# ----- 生产环境 ----
FROM base AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml .npmrc ./

CMD [ "pnpm", "run", "start" ]