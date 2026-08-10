# Deployment Guide for AudienceQuery

This guide provides instructions for deploying the AudienceQuery application to various environments: a local machine, a Docker container, and the Vercel platform.

## Prerequisites

- **Node.js**: Version 18.x or later.
- **npm**: Should be installed with Node.js.
- **Git**: For cloning the repository.
- **Docker**: (Optional) Required only for Docker-based deployment.
- **Vercel CLI**: (Optional) Required only for Vercel deployment.

---

## 1. Local Machine Deployment

Deploying on a local machine is suitable for testing, and small-scale, trusted environments.

### Steps:

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd AudienceQuery
    ```

2.  **Install Dependencies**
    Install all the necessary `npm` packages.
    ```bash
    npm install
    ```

3.  **Build the Application**
    This command bundles the React frontend using Vite and compiles the TypeScript server using `esbuild`. The output is placed in the `dist` directory.
    ```bash
    npm run build
    ```

4.  **Start the Server**
    This command starts the production-ready Node.js server.
    ```bash
    npm run start
    ```
    The application will be running and accessible at `http://localhost:3000`. The server will serve the static frontend and handle all API requests.

---

## 2. Docker Deployment

Docker allows you to package the application into a container, ensuring a consistent environment for development, testing, and production.

### Prerequisites:
- Docker Desktop or Docker Engine installed and running.

### Files Used:
- `Dockerfile`: A multi-stage Dockerfile that first builds the application and then creates a lean production image.
- `.dockerignore`: Ensures that unnecessary files (like local `node_modules`, git files) are not copied into the Docker image.

### Steps:

1.  **Build the Docker Image**
    From the root of the project directory, run the following command. This will execute the steps in the `Dockerfile` and create a Docker image named `audience-query`.
    ```bash
    docker build -t audience-query .
    ```

2.  **Run the Docker Container**
    Once the image is built, you can run it as a container. This command maps port 3000 of the container to port 3000 on your local machine.
    ```bash
    docker run -p 3000:3000 --name audience-query-container audience-query
    ```
    - `-p 3000:3000`: Maps the host port to the container port.
    - `--name audience-query-container`: Assigns a memorable name to the container.

The application is now running inside a Docker container and is accessible at `http://localhost:3000`.

---

## 3. Vercel Deployment

Vercel is an excellent platform for deploying modern web applications. The Express.js backend will be deployed as a Serverless Function, and the frontend will be served by Vercel's CDN.

### Prerequisites:
- A Vercel account.
- Vercel CLI installed (`npm install -g vercel`).

### Files Used:
- `vercel.json`: Configures Vercel on how to build and route requests. It tells Vercel to treat the `dist/server.cjs` file as a serverless function for API routes and serves the static frontend from the `dist` directory.

### Steps:

1.  **Link the Project to Vercel**
    Navigate to the project's root directory and run:
    ```bash
    vercel
    ```
    - If it's your first time deploying this project, the Vercel CLI will guide you through linking it to a new or existing Vercel project.
    - Accept the default settings when prompted. Vercel will automatically detect the project type and use the `vercel.json` file for configuration.

2.  **Deploy**
    The `vercel` command will start the deployment process. It will install dependencies, run the `npm run build` script (as defined in `package.json`), and deploy the output.

3.  **Production Deployment**
    For subsequent production deployments, run:
    ```bash
    vercel --prod
    ```

Vercel will provide you with a unique URL where your application is deployed. The API endpoints (e.g., `/api/questions`) will be handled by the serverless function, and all other routes will serve the React application.
