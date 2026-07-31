FROM node:22-alpine AS build

WORKDIR /app
ARG VITE_API_URL=/api
ARG VITE_WORK_INTAKE_URL=/intake
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WORK_INTAKE_URL=${VITE_WORK_INTAKE_URL}

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
