from sanic import Sanic, response, Blueprint
from sanic.views import HTTPMethodView
from sanic.response import text
from action.decorators import handler

bp = Blueprint('concordance')


@handler(template='query.html')
@bp.route('/query')
async def get(request):
    return {}
