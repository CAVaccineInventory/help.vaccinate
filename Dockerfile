FROM ruby:2.7.2-alpine

RUN apk add npm bash git make g++
# netlify command line tool for functions testing
RUN npm install netlify-cli -g

RUN mkdir -p /app/node_modules
WORKDIR /app

# don't copy everything so we don't rebuild all the time.
COPY *.json Gemfile* /app/
COPY script/* /app/script/
RUN /app/script/install
# stop builder from re-running this
RUN touch /app/node_modules/.no-refresh
RUN touch /app/apps/node_modules/.no-refresh


COPY ./ /app/
RUN /app/script/build


CMD ["netlify", "dev"]
