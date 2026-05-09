from flask import Flask, render_template
import json

app = Flask(__name__)

# ensure that we can reload when we change the HTML / JS for debugging
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True



@app.route('/')
def data():
    # replace this with the real data
    testData = ["hello", "infovis", "2026"]

    # return the index file and the data
    return render_template("index.html", data=json.dumps(testData))


if __name__ == '__main__':
    app.run()
