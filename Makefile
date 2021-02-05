-include Makefile.local
docker-run:
	docker build -t test . && docker run -it --rm  -p 8080:8080  -e AIRTABLE_API_KEY=${AIRTABLE_API_KEY} -e AIRTABLE_BASE=appB9VdNQI7wTFzDF -v "$(pwd):/app" test
