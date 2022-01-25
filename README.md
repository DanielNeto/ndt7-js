Cliente Javascript oficial do [NDT7](https://github.com/m-lab/ndt-server) adaptado para os servidores do serviço MonIPÊ.

Inclui exemplos no diretório `examples/`.

# API Reference
<a name="ndt7"></a>

## ndt7 : <code>object</code>
**Kind**: global namespace  

* [ndt7](#ndt7) : <code>object</code>
    * [.downloadTest](#ndt7.downloadTest) ⇒ <code>number</code>
    * [.uploadTest](#ndt7.uploadTest) ⇒ <code>number</code>
    * [.test](#ndt7.test) ⇒ <code>number</code>

<a name="ndt7.downloadTest"></a>

### ndt7.downloadTest ⇒ <code>number</code>
downloadTest executa apenas o teste de download NDT7.

**Kind**: static property of [<code>ndt7</code>](#ndt7)  
**Returns**: <code>number</code> - Zero em caso de sucesso e código de erro diferente de zero em caso de falha.  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Uma matriz associativa de strings de configuração |
| userCallbacks | <code>Object</code> |  |

<a name="ndt7.uploadTest"></a>

### ndt7.uploadTest ⇒ <code>number</code>
uploadTest executa apenas o teste de upload NDT7.

**Kind**: static property of [<code>ndt7</code>](#ndt7)  
**Returns**: <code>number</code> - Zero em caso de sucesso e código de erro diferente de zero em caso de falha.  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Uma matriz associativa de strings de configuração |
| userCallbacks | <code>Object</code> |  |

<a name="ndt7.test"></a>

### ndt7.test ⇒ <code>number</code>
test executa o teste de download seguido pelo teste de upload.

**Kind**: static property of [<code>ndt7</code>](#ndt7)  
**Returns**: <code>number</code> - Zero em caso de sucesso e código de erro diferente de zero em caso de falha.  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Uma matriz associativa de strings de configuração |
| userCallbacks | <code>Object</code> |  |

## Config : <code>object</code>

| Param | Type | Description |
| --- | --- | --- |
| state | <code>String</code> | Estado (UF) do servidor a ser usado nos testes. |
| libraryPath | <code>String</code> | Path relativo das bibliotecas Javascript. |
