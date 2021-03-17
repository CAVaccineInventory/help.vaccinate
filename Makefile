-include Makefile.local
docker-run:
	docker build --build-arg NO_PREBUILD=1 -t test . && docker run -it --rm -p 35729:35729 -p 8080:8080 -p 4000:4000 -e AIRTABLE_API_KEY=${AIRTABLE_API_KEY} -e AIRTABLE_BASE=appomMFgCyI8LjHUz -e AIRTABLE_DUPLICATE_BASE=${AIRTABLE_DUPLICATE_BASE} -v "$(shell pwd):/app" test
netlify-run:
	AIRTABLE_API_KEY=${AIRTABLE_API_KEY} AIRTABLE_BASE=appomMFgCyI8LjHUz AIRTABLE_DUPLICATE_BASE=${AIRTABLE_DUPLICATE_BASE} netlify dev
