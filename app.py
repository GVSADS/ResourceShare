import flask


app = flask.Flask(__name__, template_folder = "./", static_folder = "./", static_url_path = "/")

@app.route('/')
def index():
    return flask.render_template('test.html')

app.run(debug = True)