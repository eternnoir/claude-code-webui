# Build stage
FROM --platform=linux/amd64 ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y \
    curl \
    ca-certificates \
    unzip && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

WORKDIR /app

# Copy all source files
COPY . .

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Build the executable
WORKDIR /app/backend
RUN npm ci
RUN cp -r ../frontend/dist ./dist
RUN deno task build

# The executable is now at /app/dist/claude-code-webui

# Final image
FROM --platform=linux/amd64 ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y \
    ca-certificates \
    curl \
    git && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js for Claude Code CLI
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Create app directory
WORKDIR /app

# Copy the built executable
COPY --from=builder /app/dist/claude-code-webui /app/claude-code-webui

# Make it executable
RUN chmod +x /app/claude-code-webui

# Create mount points
RUN mkdir -p /root/.claude /data

# Expose the port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV CLAUDE_PATH=/usr/bin/claude
ENV ANTHROPIC_BASE_URL=""

# Volume mount points
VOLUME ["/root/.claude", "/data"]

# Start the application
CMD ["/app/claude-code-webui", "--host", "0.0.0.0"]