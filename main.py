#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import webapp2
import jinja2

import os
import json

import logging

JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)

class MainHandler(webapp2.RequestHandler):
    def get(self):
        template = JINJA_ENVIRONMENT.get_template('index.html')
        self.response.write(template.render())

    def post(self):
    	tupleArray = self.request.get_all('tuple[]')

    	total = 1;
    	for x in tupleArray:
    		total *= long(x)

    	data = {'tag' : self.request.get('tag'), 'total' : str(total)}
    	self.response.out.headers['Content-Type'] = 'text/json'
    	self.response.out.write(json.dumps(data))
    	return

app = webapp2.WSGIApplication([
    ('/', MainHandler)
], debug=True)
