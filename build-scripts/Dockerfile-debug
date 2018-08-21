FROM registry.gitlab.com/misutka/docker-kontext-base:v2.158.8

MAINTAINER Mr. Tester "lindat-technical@ufal.mff.cuni.cz"

ENV PORT 5000

WORKDIR /opt/kontext/installation
COPY . /opt/kontext/installation
EXPOSE 5000
CMD ["python", "public/app.py", "--port=$PORT", "--address=0.0.0.0"]
