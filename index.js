const axios = require('axios').default;
require('dotenv').config();
const savedProdis = require('./logs/savedProdis.json');
const savedMahasiswas = require('./logs/savedMahasiswas.json');
const savedError = require('./logs/savedError.json');
const savedProdis1 = require('./results/0-299/global_prodis.json');
const savedMahasiswas1 = require('./results/0-299/global_mahasiswas.json');
const savedError1 = require('./results/0-299/global_errors.json');
const savedProdis2 = require('./results/300-499/global_prodis.json');
const savedMahasiswas2 = require('./results/300-499/global_mahasiswas.json');
const savedError2 = require('./results/300-499/global_errors.json');
const savedProdis3 = require('./results/500-end/global_prodis.json');
const savedMahasiswas3 = require('./results/500-end/global_mahasiswas.json');
const savedError3 = require('./results/500-end/global_errors.json');
const { removeWhiteSpaceInStartAndEnd, writeLog } = require('./utils');

const PDDIKTI_API_BASE_URL = 'https://api-frontend.kemdikbud.go.id';
const INPUT_PATH = process.env.FILE_INPUT_PATH;
const dataAwardee = require(INPUT_PATH);
const PddiktiApi = axios.create({
  baseURL: PDDIKTI_API_BASE_URL,
});

const global_errors = [];
const global_prodis = [];
const global_mahasiswas = [];

const getCleanNim = (dirtyNIM) => {
  const nim = dirtyNIM.replace(/\W/gi, '');
  return nim;
};

const formatQuery = (query) => {
  return query.replace(/\s/g, '%20');
};

const getCleanMahasiswaData = (data) => {
  const mahasiswaId = data['website-link'].replace('/data_mahasiswa/', '');
  const [nameNim, dirtyPT, dirtyProdi] = data.text.split(',');
  const regexForExtractNameAndNim = /(.*)+\((.*)\)/gi;
  const [_, name, nim] = regexForExtractNameAndNim.exec(nameNim);
  const [__, pt] = dirtyPT
    .split(':')
    .map((item) => removeWhiteSpaceInStartAndEnd(item));
  const [___, prodi] = dirtyProdi
    .split(':')
    .map((item) => removeWhiteSpaceInStartAndEnd(item));

  return {
    mahasiswaId,
    name,
    nim,
    pt,
    prodi,
    id_prodi: null,
  };
};

const getMahasiswa = async (data) => {
  const cleanNim = getCleanNim(data.nim);
  const name = formatQuery(data.nama);
  const searchResults = await PddiktiApi.get(
    `/hit_mhs/${cleanNim}%20${name}`
  ).then((res) =>
    res.data.mahasiswa.map((data) => getCleanMahasiswaData(data))
  );
  const selectedMahasiswa = searchResults.find((item) => item.nim === cleanNim);
  if (selectedMahasiswa) {
    const returnValue = {
      ...selectedMahasiswa,
      rawProdi: data.prodi,
    };
    global_mahasiswas.push(returnValue);
    return returnValue;
  }

  global_errors.push({
    name,
    nim: cleanNim,
    message: 'data mahasiswa tidak ditemukan',
  });
  return null;
};

const updateDataMahasiswa = (mahasiswaId, newData) => {
  const mahasiswaIndex = global_mahasiswas.findIndex(
    (mahasiswa) => mahasiswa.mahasiswaId === mahasiswaId
  );
  global_mahasiswas[mahasiswaIndex] = {
    ...global_mahasiswas[mahasiswaIndex],
    ...newData,
  };
};

const getProdiId = (mahasiswa) =>
  PddiktiApi.get(`/detail_mhs/${mahasiswa.mahasiswaId}`).then(({ data }) => {
    const id_prodi = data.dataumum.link_prodi.replace('/data_prodi/', '');
    updateDataMahasiswa(mahasiswa.mahasiswaId, {
      id_prodi,
    });
    return {
      id_prodi,
      id_mahasiswa: mahasiswa.mahasiswaId,
    };
  });

const getDataProdi = (prodi) =>
  PddiktiApi.get(`/detail_prodi/${prodi.id_prodi}`).then((res) => ({
    ...res.data.detailumum,
    id_prodi: prodi.id_prodi,
  }));

const pushProdi = (prodi) => {
  const globalProdiIndex = global_prodis.findIndex(
    (item) => item.id_prodi === prodi.id_prodi
  );
  if (globalProdiIndex < 0) {
    global_prodis.push(prodi);
  }
};

const mainFunctiion = async (datas, startIndex) => {
  console.log('starting fecthing mahasiswas on startIndex : ', startIndex);
  const mahasiswas = await Promise.all(datas.map(getMahasiswa)).then((res) =>
    res.filter((item) => item)
  );
  console.log('finished fecthing mahasiswas on startIndex : ', startIndex);
  console.log('starting fecthing prodiIds on startIndex : ', startIndex);
  const prodiIds = await Promise.all(mahasiswas.map(getProdiId)).then((res) =>
    res.filter((item) => item)
  );
  console.log('finished fecthing prodiIds on startIndex : ', startIndex);
  console.log('starting fecthing prodiDatas on startIndex : ', startIndex);
  const prodiDatas = await Promise.all(prodiIds.map(getDataProdi)).then((res) =>
    res.filter((item) => item)
  );
  console.log('finished fecthing prodiDatas on startIndex : ', startIndex);
  console.log(
    'starting pushing prodiDatas to global_prodis on startIndex : ',
    startIndex
  );
  prodiDatas.forEach(pushProdi);
};

const getData = async () => {
  const newData = dataAwardee.slice(500, 900);
  let startIndex = 0;
  while (startIndex <= newData.length) {
    console.time('Execution Time');
    const datas = newData.slice(startIndex, startIndex + 10);
    try {
      await mainFunctiion(datas, startIndex);
    } catch (error) {
      console.log(error);
    } finally {
      startIndex += 10;
      console.timeEnd('Execution Time');
    }
  }
  console.log('writting log');
  writeLog('global_prodis.json', global_prodis);
  writeLog('global_mahasiswas.json', global_mahasiswas);
  writeLog('global_errors.json', global_errors);
};

const checkData = async () => {
  console.log('savedProdis : ', savedProdis.length);
  console.log('savedMahasiswas : ', savedMahasiswas.length);
  console.log('savedError : ', savedError.length);
};

const merge = () => {
  const savedProdis = [...savedProdis1, ...savedProdis2, ...savedProdis3];
  const savedMahasiswas = [
    ...savedMahasiswas1,
    ...savedMahasiswas2,
    ...savedMahasiswas3,
  ];
  const savedError = [...savedError1, ...savedError2, ...savedError3];

  writeLog('savedProdis.json', savedProdis);
  writeLog('savedMahasiswas.json', savedMahasiswas);
  writeLog('savedError.json', savedError);
};

checkData();
// merge();
// getData();
