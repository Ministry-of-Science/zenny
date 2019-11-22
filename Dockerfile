FROM node:6

VOLUME /zenny

WORKDIR /zenny

ENTRYPOINT node bin/zenny.js

EXPOSE 3001
