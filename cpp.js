const vscode = require('vscode');

function parseLine_(line_) {
  let line = line_.trim()
  if (line.startsWith('//')) {
    return null;
  }
  let index = 0;
  let code = {}
  let brackets = 0
  while (index < line.length) {
    if (line[index] === ' ') {
      if (brackets === 0) {
        code.type = line.substring(0, index).replace(/\s/g, '');
        break;
      } else {
        // pass
      }
    } else if (line[index] === '<') {
      brackets++;
    } else if (line[index] === '>') {
      brackets--;
    } else {
      // pass
    }
    index++;
  }
  if (index === line.length) {
    return null;
  }
  line = line.substring(index).trimLeft()
  index = 0;
  while (index < line.length) {
    if (line[index] === ';') {
      code.var = line.substring(0, index).replace(/\s/g, '');
      if (code.var && (code.var[0] === '*' || code.var[0] === '&')) {
        // pointer or reference
        code.type += code.var[0];
        code.var = code.var.substring(1);
      }
      break;
    } else {
      // pass
    }
    index++;
  }
  if (index != line.length) {
    code.comment = line.substring(index).trimLeft();
  }
  code.varLite = code.var.substring(0, code.var.length - 1)
  return code;
}

const PRIMARY_TYPE = [
  'bool',
  'double', 'float',
  'int', 'uint', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t',
]

function isPrimaryType_(varType) {
  return PRIMARY_TYPE.indexOf(varType) !== -1;
}

function isPointerType_(varType) {
  return varType.endsWith('*');
}

function isSmartPtr_(
  /*@param {string}*/
  varType) {
  return varType.endsWith('Ptr');
}

function genSet_(variable, primaryType) {
  if (primaryType === undefined) {
    primaryType = isPrimaryType_(variable.type);
  }
  const pointerType = isPointerType_(variable.type);
  const smartPointer = isSmartPtr_(variable.type);

  let code = [];
  if (primaryType || smartPointer || pointerType) {
    code = [
      'void set_', variable.varLite, '(', variable.type, ' ', variable.varLite, ')',
      ' { ', variable.var, ' = ', variable.varLite, '; }',
    ]
  } else {
    code = [
      'void set_', variable.varLite, '(const ', variable.type, ' &', variable.varLite, ')',
      ' { ', variable.var, ' = ', variable.varLite, '; }',
    ]
  }
  return code.join('');
}

function genGet_(variable, primaryType) {
  if (primaryType === undefined) {
    primaryType = isPrimaryType_(variable.type);
  }

  const pointerType = isPointerType_(variable.type);
  const smartPointer = isSmartPtr_(variable.type);

  if (primaryType || pointerType || smartPointer) {
    return [
      variable.type, ' ', variable.varLite, '() const ',
      '{ return ', variable.var, '; }',
    ].join('');
  } else {
    return [
      [
        'const ', variable.type, '& ', variable.varLite, '() const ',
        '{ return ', variable.var, '; }',
      ]
    ].map(function (code) {
      return code.join('');
    }).join('\n');
  }
}

function genGetterSetter_(props) {
  return function () {
    let editor = vscode.window.activeTextEditor;
    let selection = editor.selection;
    if (!selection) {
      vscode.window.showInformationMessage('No variables selected.');
      return;
    }
    let codes = [
      '',
      ' public:'
    ];

    if (props.indexOf('get') >= 0 || props.indexOf('set') >= 0) {
      codes.push('  // getters and setters');
    }

    for (let index = selection.start.line; index <= selection.end.line; index++) {
      let line = editor.document.lineAt(index).text;
      let variable = parseLine_(line);
      if (!variable) {
        continue;
      }
      let code = '';
      let primaryType = isPrimaryType_(variable.type);
      if (props.indexOf('get') >= 0) {
        code += '  ' + genGet_(variable, primaryType) + '\n';
      }
      if (props.indexOf('set') >= 0) {
        code += '  ' + genSet_(variable, primaryType);
      }
      codes.push(code);
    }

    codes.push('')
    const content = codes.join('\n');
    const insertPosition = new vscode.Position(selection.end.line + 1, 0);
    editor.edit(function (editBuilder) {
      editBuilder.insert(insertPosition, content);
    })
  }
}

function genHeaderGuard_() {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  let headerPath = editor.document.fileName;
  if (!headerPath.endsWith('.h')) {
    vscode.window.showInformationMessage('Not a cpp header file.');
    return;
  }
  const relativePath = vscode.workspace.asRelativePath(headerPath);
  const guard = relativePath.toUpperCase().replace(/[^\w]/g, '_');
  const startGuard = [
    '#ifndef ', guard, '\n',
    '#define ', guard, '\n',
    '#pragma once',
    '\n', '\n', '\n'
  ].join('');
  const endGuard = [
    '\n',
    '#endif ', '// ', guard
  ].join('');
  const startPosition = new vscode.Position(0, 0),
    endPosition = new vscode.Position(editor.document.lineCount, 0);
  editor.edit(function (editBuilder) {
    editBuilder.insert(startPosition, startGuard);
    editBuilder.insert(endPosition, endGuard);
  })
}

const commands = {
  'extension.genHeaderGuard': genHeaderGuard_,
  'extension.genGetter': genGetterSetter_(['get']),
  'extension.genSetter': genGetterSetter_(['set']),
  'extension.genGetterSetter': genGetterSetter_(['get', 'set']),
}

module.exports = {
  commands
}