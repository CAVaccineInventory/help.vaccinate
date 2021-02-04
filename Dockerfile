FROM ruby:2.7.2-buster

RUN apt-get update && apt-get install -y build-essential git npm && apt-get -y clean

RUN mkdir -p /app/node_modules
WORKDIR /app

COPY *.json /app/
RUN npm install
COPY Gemfile* /app/
RUN bundle install

COPY ./ /app/

EXPOSE 4000
CMD ["/app/script/server"]
