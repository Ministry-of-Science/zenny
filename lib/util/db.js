"use strict";



//  N A T I V E

const path = require("path");

//  P A C K A G E

const fs = require("fs-extra");



//  P R O G R A M

class Db {
  constructor(filePath, defaultData) {
    this.filePath = filePath;
    this.defaultData = defaultData;
  }

  read(prototype) {
    if (!fs.existsSync(this.filePath))
      return this.defaultData;

    const fileContent = fs.readFileSync(this.filePath);

    if (fileContent.length === 0)
      return this.defaultData;

    return prototype ?
      prototype.fromJson(JSON.parse(fileContent)) :
      JSON.parse(fileContent);
  }

  write(data) {
    fs.ensureDirSync(path.dirname(this.filePath));
    fs.writeFileSync(this.filePath, JSON.stringify(data));
  }
}



//  E X P O R T

module.exports = exports = Db;
