from sanic import Sanic, response, Blueprint
from sanic.views import HTTPMethodView
from sanic.response import text

bp = Blueprint('root')


@bp.route('/')
async def get(request):
    return response.redirect('/query')

