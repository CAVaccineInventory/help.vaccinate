FROM ruby:2.7.2-alpine

RUN apk add npm bash git make g++
# netlify command line tool for functions testing
RUN npm install netlify-cli -g

RUN mkdir -p /app/node_modules
WORKDIR /app

COPY *.json /app/
RUN npm install
COPY Gemfile* /app/
RUN bundle install

COPY ./ /app/

CMD ["netlify", "dev"]
