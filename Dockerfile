FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/10-generate-config.sh /docker-entrypoint.d/10-generate-config.sh
RUN chmod +x /docker-entrypoint.d/10-generate-config.sh
