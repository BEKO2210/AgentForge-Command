# AgentForge Command — container image.
# Bundles the build toolchain so node-pty compiles without a host toolchain.
# Starts in Harness Mode by default (no ANTHROPIC_API_KEY needed to try it).
FROM node:20-slim

WORKDIR /app

# Build tools for node-pty's native addon.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching). The root package-lock.json
# covers the gui + mcp workspaces.
COPY package.json package-lock.json ./
COPY gui/package.json ./gui/
COPY mcp/package.json ./mcp/
RUN npm ci

# Then the source.
COPY . .

EXPOSE 4173

# Bind 0.0.0.0 so Docker's published port can reach it; the compose file maps
# the host side to 127.0.0.1 only. Harness mode = no API key needed to try.
ENV PORT=4173 \
    AGENTFORGE_HOST=0.0.0.0 \
    AGENTFORGE_HARNESS=1

CMD ["npm", "start"]
