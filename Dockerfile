FROM ruby:2.7.2-alpine

# set this argument to non-empty to skip building the app
# this is useful in development mode when bind-mounting
# the app dir
ARG NO_PREBUILD=


RUN apk add npm bash git make g++
# netlify command line tool for functions testing
RUN npm install netlify-cli -g

RUN mkdir -p /app/node_modules
WORKDIR /app

# don't copy everything so we don't rebuild all the time.
COPY *.json Gemfile* /app/
COPY script/* /app/script/
COPY apps/* /app/apps/
RUN if [ -z "$NO_PREBUILD" ] ; then \
        echo building ; \
        /app/script/install ; \
        touch /app/node_modules/.no-refresh ; \
        touch /app/apps/node_modules/.no-refresh ; \
        fi


COPY ./ /app/
RUN if [ -z "$NO_PREBUILD" ] ; then /app/script/build ; fi


CMD ["netlify", "dev"]
