import ast
open('app.py').read()
try:
    print(ast.parse(open('app.py').read()))
except SyntaxError as e:
    print(e)
