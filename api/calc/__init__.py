import logging
import json
import azure.functions as func


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    num1 = req.params.get('num1')
    num2 = req.params.get('num2')
    if not num1:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            num1 = req_body.get('num1')
            num2 = req_body.get('num2')

    return func.HttpResponse(json.dumps({"value": num1 + num2}))
