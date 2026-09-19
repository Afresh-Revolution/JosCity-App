import AgentWorkspaceScreen from './AgentWorkspaceScreen';
export default function AgentServicesScreen({ directory = false }: { directory?: boolean }) {
  return <AgentWorkspaceScreen role="requester" page={directory ? 'directory' : 'requests'} />;
}
