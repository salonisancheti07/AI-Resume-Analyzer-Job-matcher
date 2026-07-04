"""
Temporary patch for pydantic v1 + Python 3.12 ForwardRef API change.
"""
import typing
import pydantic.typing as pt


def _patched_evaluate_forwardref(type_: typing.ForwardRef, globalns: any, localns: any):
    try:
        # Python 3.12 expects recursive_guard kwarg
        return type_._evaluate(globalns, localns, None, recursive_guard=set())
    except TypeError:
        # Fallback for older Python
        return type_._evaluate(globalns, localns, set())


pt.evaluate_forwardref = _patched_evaluate_forwardref
try:
    import pydantic.v1.typing as pydantic_v1_typing
    pydantic_v1_typing.evaluate_forwardref = _patched_evaluate_forwardref
except ImportError:
    pass

