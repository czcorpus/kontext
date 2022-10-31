FROM czcorpus/kontext-manatee:2.167.10

RUN pip3 install --upgrade pip && pip3 install aiohttp

WORKDIR /opt/kontext
COPY . .
RUN pip3 install -r requirements.txt
RUN python3 scripts/install/steps.py SetupKontext

CMD [ "python3", "public/ws_app.py", "--host", "0.0.0.0" ]
