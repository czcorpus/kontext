
from typing import Any, Dict, Callable
from types import MethodType
import werkzeug


def _action_defaults(fun: Callable[..., Dict[str, Any]]) -> Dict[str, Any]:
    """
    Returns a dictionary containing default argument names and
    their respective values. This is used when invoking func_arg_mapped
    action method for URL -> func mapping.

    arguments:
    fun -- an action method with some default arguments
    """
    try:
        default_vals = fun.__defaults__ or ()
    except AttributeError:
        return {}
    default_varnames = fun.__code__.co_varnames
    return dict(list(zip(default_varnames[fun.__code__.co_argcount - len(default_vals):], default_vals)))


def convert_func_mapping_types(args: Dict[str, Any], fun: Callable[..., Dict[str, Any]], del_nondef: bool = False
                               ) -> Dict[str, Any]:
    """
    Converts string values as received from GET/POST data into types
    defined by actions' parameters (type is inferred from function's default
    argument values).
    """
    corr_func: Dict[Any, Callable[[Any], Any]] = {type(0): int, type(0.0): float, tuple: lambda x: [x]}
    ans = {}
    ans.update(_action_defaults(fun))
    for k, value in args.items():
        if k.startswith('_') or type(ans.get(k, None)) is MethodType:
            continue
        if k in list(ans.keys()):
            default_type = type(ans[k])
            if default_type is not tuple and type(value) is tuple:
                ans[k] = value[-1]
            elif default_type is tuple and type(value) is list:
                ans[k] = tuple(value)
            elif type(value) is not default_type:
                try:
                    ans[k] = corr_func.get(default_type, lambda x: x)(value)
                except ValueError as e:
                    raise werkzeug.exceptions.BadRequest(
                        description='Failed to process parameter "{0}": {1}'.format(k, e))
            else:
                ans[k] = value
        elif not del_nondef:
            ans[k] = value
    return ans
