require 'digest/sha2'

# Based on https://distresssignal.org/busting-css-cache-with-jekyll-md5-hash
module Jekyll
  module ContentTag
    def content_tag(file_name)
      absolute = file_name.start_with?('/')
      file_name = file_name[1..-1] if absolute
      contents = File.read(file_name)
      digest = Digest::SHA256.hexdigest(contents)
      "#{absolute ? '/' : ''}#{file_name}?#{digest}"
    end
  end
end

Liquid::Template.register_filter(Jekyll::ContentTag)
