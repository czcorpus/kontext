# Must be called from main main directory, but
# we do not want to pollute it with test specific
# dockerfiles
FROM ubuntu:16.04

MAINTAINER Mr. Tester "lindat-technical@ufal.mff.cuni.cz"

WORKDIR /opt/kontext/deploy/current/
ADD .  /opt/kontext/deploy/current/
ENV PORT 5000

RUN apt-get update && apt-get install -y sudo

RUN ./build-scripts/setup.sh && \
    INTEGRATIONTEST=true ./build-scripts/test.sh
