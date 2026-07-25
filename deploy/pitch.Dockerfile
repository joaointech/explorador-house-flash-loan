# Static pitch deck served by nginx on Cloud Run (port 8080).
# Build context is the repo root:
#   docker build -f deploy/pitch.Dockerfile -t ethglobal-pitch .
FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY pitch/ /usr/share/nginx/html/
EXPOSE 8080
