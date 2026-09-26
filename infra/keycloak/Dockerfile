FROM quay.io/keycloak/keycloak:26.7.4 AS base
COPY healthcheck.sh /opt/keycloak/healthcheck.sh
# Imported on start only when the realm doesn't exist yet; ${ENV} placeholders resolve from the container env.
COPY realm-app.json /opt/keycloak/data/import/realm-app.json

FROM base AS dev
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start-dev", "--import-realm"]

FROM base AS build
ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM base AS runtime
COPY --from=build /opt/keycloak/ /opt/keycloak/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
