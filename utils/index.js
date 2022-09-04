const removeWhiteSpaceInStartAndEnd = (text) => {
  return text.replace(/(^\s|\s$)/gi, '');
};

const removeWhitespace = (text) => {
  return text.replace(/\s/gi, '');
};

function writeLog(file, data) {
  const dir = `logs`;
  const path = `${dir}/${file}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return fsPromise.writeFile(path, JSON.stringify(data, null, 2));
}

module.exports = {
  removeWhiteSpaceInStartAndEnd,
  removeWhitespace,
  writeLog,
};
