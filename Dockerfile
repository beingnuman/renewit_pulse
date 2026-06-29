# Step 1: Build the React app
FROM node:22.19 AS build

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies with legacy peer deps to avoid react version conflict
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Build the React app with increased memory allocation
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Step 2: Serve the React app with nginx
FROM nginx:alpine

# Copy the built files from the previous step
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port nginx will run on
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
