export const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

export function createSourceProvidersXml(): string {
  return `${XML_HEADER}
<sourceProviders>
  <sourceprovider>
    <id>10003</id>
    <createdOn>2012-09-19T12:43:00.000+00:00</createdOn>
    <name>LOCAL_INTERNET_RADIO</name>
    <updatedOn>2012-09-19T12:43:00.000+00:00</updatedOn>
  </sourceprovider>
  <sourceprovider>
    <id>10002</id>
    <createdOn>2012-09-19T12:43:00.000+00:00</createdOn>
    <name>INTERNET_RADIO</name>
    <updatedOn>2012-09-19T12:43:00.000+00:00</updatedOn>
  </sourceprovider>
</sourceProviders>`;
}

export function createAccountFullXml(
  accountId: string,
  streamUrl: string,
): string {
  return `${XML_HEADER}
<account id="${accountId}">
  <accountStatus>OK</accountStatus>
  <mode>global</mode>
  <preferredLanguage>en</preferredLanguage>
  <devices/>
  <sources>
    <source id="1" type="Audio">
      <createdOn>2012-09-19T12:43:00.000+00:00</createdOn>
      <credential type="token"></credential>
      <name>LOCAL_INTERNET_RADIO</name>
      <sourceproviderid>10003</sourceproviderid>
      <sourcename>Local Radio Source</sourcename>
      <sourceSettings>
        <location>${streamUrl}</location>
      </sourceSettings>
      <updatedOn>2012-09-19T12:43:00.000+00:00</updatedOn>
      <username>${accountId}</username>
    </source>
  </sources>
</account>`;
}
