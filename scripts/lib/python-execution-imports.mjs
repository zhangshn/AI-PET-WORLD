// Syntax-only dependency extraction shared by the registered execution collectors.
// The target Python source is parsed, never imported or evaluated.
export const pythonExecutionImportAst = `import ast,json,sys
result=[]
for item in json.load(sys.stdin):
 tree=ast.parse(item['source'],filename=item['path'])
 imports=[];excluded=[]
 rule=item.get('deferredSurface') or {}
 def walk(node,scope=(),disabled=False):
  if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
   # Decorators, arguments/defaults and class bases belong to the containing
   # execution scope. A function-body exclusion must not erase these imports.
   for field,value in ast.iter_fields(node):
    if field=='body':continue
    children=value if isinstance(value,list) else [value]
    for child in children:
     if isinstance(child,ast.AST):walk(child,scope,disabled)
   body_scope=(*scope,node.name)
   body_disabled=disabled
   if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and len(body_scope)==1:
    body_disabled=(('includeScopes' in rule and node.name not in rule['includeScopes']) or node.name in rule.get('excludeScopes',[]))
   for child in node.body:walk(child,body_scope,body_disabled)
   return
  if isinstance(node,ast.Import):
   for v in node.names:
    (excluded if disabled else imports).append({'module':v.name,'level':0,'names':[],'line':node.lineno,'scope':'.'.join(scope)})
  elif isinstance(node,ast.ImportFrom):
   entry={'module':node.module or '', 'level':node.level,'names':[v.name for v in node.names],'line':node.lineno,'scope':'.'.join(scope)}
   excluded_import=any(all(entry.get(k)==v for k,v in row.items()) for row in rule.get('excludeImports',[]))
   (excluded if disabled or excluded_import else imports).append(entry)
  elif isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=='import_module':
   if node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str):
    (excluded if disabled else imports).append({'module':node.args[0].value,'level':0,'names':[],'line':node.lineno,'scope':'.'.join(scope),'dynamicLiteral':True})
  for child in ast.iter_child_nodes(node):walk(child,scope,disabled)
 walk(tree)
 result.append({'path':item['path'],'imports':imports,'excludedLateImports':excluded})
json.dump(result,sys.stdout)
`;
