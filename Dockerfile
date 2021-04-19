FROM ruby:2.7.2-alpine

RUN apk add npm bash git

RUN mkdir -p /app/node_modules
WORKDIR /app

# don't copy everything so we don't rebuild all the time.
COPY *.json Gemfile* /app/
COPY script/* /app/script/
COPY apps/* /app/apps/

CMD ["./script/server"]
